import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Document } from "@langchain/core/documents";
import { HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { NextResponse } from "next/server";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { Filters, ProductType } from "@/utils/types";
import {
  AstraDBVectorStore,
  AstraLibArgs,
} from "@langchain/community/vectorstores/astradb";

// Environment variables
const { ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_ENDPOINT, GOOGLE_API_KEY } =
  process.env;

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Initialize chat and embeddings models
    const gemini_model = new ChatGoogleGenerativeAI({
      apiKey: GOOGLE_API_KEY,
      modelName: "gemini-pro-vision",
      streaming: false,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const embeddings_model = new GoogleGenerativeAIEmbeddings({
      apiKey: GOOGLE_API_KEY,
      modelName: "embedding-001",
    });

    // Create astra config and initailize vector store
    const astraConfig: AstraLibArgs = {
      token: ASTRA_DB_APPLICATION_TOKEN,
      endpoint: ASTRA_DB_ENDPOINT,
      collection: "fashion_buddy",
      collectionOptions: {
        vector: {
          dimension: 768,
          metric: "cosine",
        },
      },
      contentKey: "details",
    };

    const astra = new AstraDBVectorStore(embeddings_model, astraConfig);
    await astra.initialize();

    // Create our retriever chain
    const astraRetrieverChain = RunnableSequence.from([
      RunnableLambda.from((input: string) =>
        embeddings_model.embedQuery(input)
      ).withConfig({ runName: "GetEmbedding" }),
      RunnableLambda.from((input: number[]) =>
        astra.similaritySearchVectorWithScore(
          input,
          10,
          getFilters(data.filters)
        )
      ).withConfig({ runName: "GetProductsFromAstra" }),
      RunnableLambda.from((input: [Document, number][]) =>
        mapDocsToProducts(input)
      ).withConfig({ runName: "MapDocsToProducts" }),
    ]).withConfig({ runName: "AstraRetrieverChain" });

    // Create our core chain
    const chain = RunnableSequence.from([
      gemini_model,
      new StringOutputParser(),
      astraRetrieverChain,
    ]);

    // Creates the initial message containing the image and prompt
    const message = [
      new HumanMessage({
        content: [
          {
            type: "text",
            text: getPrompt(data.filters),
          },
          {
            type: "image_url",
            image_url: data.imageBase64,
          },
        ],
      }),
    ];

    // Invoke the chain using the multi-modal message
    const products = await chain.invoke(message);

    return NextResponse.json({ products }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const mapDocsToProducts = (docs: [Document, number][]): ProductType[] => {
  // print docs
  console.log(docs)
  return docs.map((doc) => {
    const { $vector, ...cleanMetadata } = doc[0].metadata;
    return {
      ...cleanMetadata,
      details: doc[0].pageContent,
      $similarity: doc[1],
    } as ProductType;
  });
};

const getPrompt = (filters: Filters): string => {
  const categories = filters.categories.length > 0 ? filters.categories : "";

  return `Give a description of each clothing item worn in this photo${
    categories
      ? ` that fall into one the following categories: 
        ${categories.join(", ")}`
      : ""
  }`;
};

// Create a filter object
const getFilters = (filters: Filters): Record<string, any> => {
  let filter = {};
  let categoryFilter;
  let genderFilter;

  if (filters.categories.length > 0) {
    categoryFilter = {
      $or: filters.categories.map((category) => ({ category: category })),
    };
  }

  if (filters.gender.length && filters.gender[0] !== "all") {
    genderFilter = { gender: filters.gender[0] };
  }

  // use $and if necessary
  if (categoryFilter && genderFilter) {
    filter = {
      $and: [categoryFilter, genderFilter],
    };
  } else if (categoryFilter || genderFilter) {
    filter = categoryFilter ? categoryFilter : genderFilter;
  }

  return filter;
};
