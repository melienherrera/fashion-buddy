'use client';
import { useEffect, useState } from 'react';
import { useImage, useProcessedImage } from '@/components/ImageContext';
import ResultsContainer from '@/components/ResultsContainer';
import Image from 'next/image';
import { ArrowRepeat, Cart, FilterLeft } from 'react-bootstrap-icons';
import { useRouter } from 'next/navigation';
import loadingGif from '@/assets/hourglass.gif';
import { Filters } from '@/utils/types';
import FilterDrawer from '@/components/FilterDrawer';
import FilterDialog from '@/components/FilterDialog';
import Link from 'next/link';

export default function RecommendedProducts() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [items, setItems] = useState([]);
  const [image] = useImage();
  const [processedImage] = useProcessedImage();
  const [filterDialogOpen, setFilterDialogOpen] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    categories: [],
    gender: ['all'],
  });

  const getProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: processedImage.base64Data,
          fileType: processedImage.fileType,
          filters,
        }),
      });

      const data = await response.json();

      const items = data.products;
      setItems(items);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (processedImage) {
      getProducts();
    } else {
      router.push('/');
    }
  }, []);

  const formatTitle = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
  };

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }

    // Cleanup function to remove the class when the component unmounts
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [isOpen]);

  return (
    <>
      <div className="cream-background h-screen">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Image src={loadingGif} alt="loading" width={80} height={80} />
          </div>
        ) : (
          <div className="flex flex-col md:p-0 h-full ">
            {/* Filter Results desktop */}
            <div className="hidden md:flex w-full">
              <div
                className="fixed top-6 right-6"
                onClick={() => setIsOpen(!isOpen)}>
                <button className="flex gap-2 items-center justify-center rounded-full cream-background px-6 py-3">
                  <img
                    className="w-6 h-6 rounded-full mx-auto object-cover"
                    src={image}
                    alt="user image"
                  />
                  Filter Results
                  <FilterLeft size={24} />
                </button>
              </div>

              <div className="min-h-screen max-w-full ">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {items.map((item) => (
                    <div key={item._id} className="w-full h-auto">
                      <Image
                        src={item.product_images}
                        alt={item.product_name}
                        width={600}
                        height={400}
                        objectFit="cover"
                      />
                      <div className="p-4 cream-background max-w-[600px]">
                        {' '}
                        <h5 className="text-base font-semibold truncate pb-2">
                          {formatTitle(item.product_name)}
                        </h5>
                        <p className="truncate-desc text-sm text-gray-600">
                          {item.details}
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                          <div className="flex-auto text-lg font-bold">
                            ${item.price}
                          </div>
                          <button className="bg-white cursor-default py-2 px-2 rounded-full flex justify-center items-center text-xs text-nowrap whitespace-nowrap">
                            {Math.round(item.$similarity * 1000) / 10}% Match
                          </button>
                          <Link
                            className="slime-background hover:brightness-75 py-2 px-4 rounded-full flex justify-center items-center"
                            href={item.link}
                            rel="noopener noreferrer"
                            target="_blank">
                            <button className="rounded-full flex justify-center items-center text-xs text-nowrap whitespace-nowrap">
                              <Cart className="mr-2" />
                              Buy
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col h-screen md:hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b-2 border-black">
                <div className="flex items-center text-lg	">
                  <Image
                    className="rounded-full mr-3"
                    src={image}
                    width={24}
                    height={24}
                    alt="user image"
                  />
                  Results
                </div>
                <button
                  className="flex items-center text-lg"
                  onClick={() => setIsOpen(true)}>
                  Filter <FilterLeft width={24} height={24} className="ml-3" />
                </button>
              </div>

              {/* Results Content (scrollable) */}
              <div className="flex-1 overflow-auto">
                {items && <ResultsContainer items={items} />}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-center py-8 px-4 border-t-2">
                <button
                  className="flex items-center justify-center rounded-full w-full font-medium text-white bg-black p-3 text-lg leading-snug tracking-tight"
                  type="button">
                  <ArrowRepeat className="mr-2" />
                  Choose a new outfit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* <FilterDialog
        isOpen={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={() => {
          getProducts();
          setFilterDialogOpen(false);
        }}
      /> */}
      <FilterDrawer
        onClose={() => setIsOpen(false)}
        setFilters={setFilters}
        filters={filters}
        isOpen={isOpen}
        onApply={() => {
          getProducts();
          setIsOpen(false);
        }}
      />
    </>
  );
}
