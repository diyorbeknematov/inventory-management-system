import {
  useEffect,
  useState,
} from "react";

import type {
  ChangeEvent,
} from "react";

import {
  Package,
  Plus,
  X,
} from "lucide-react";

import { createProduct } from "../../api/product";
import { getCategories } from "../../api/categories";
import { getMerchants } from "../../api/merchants";
import { uploadImages } from "../../api/files";

import type {
  CreateProductRequest,
  CreateProductVariation,
  CreateVariationState,
} from "../../types/products";

import type {
  Category as SimpleCategory,
} from "../../types/category";

import type {
  Merchant,
} from "../../types/merchant";

type CreateProductModalProps = {
  merchantId?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

export default function CreateProductModal({
  merchantId,
  onClose,
  onCreated,
}: CreateProductModalProps) {
  const [productName, setProductName] =
    useState("");

  const [categories, setCategories] =
    useState<SimpleCategory[]>([]);

  const [categoryId, setCategoryId] =
    useState("");

  const [merchants, setMerchants] =
    useState<Merchant[]>([]);

  const [selectedMerchantId, setSelectedMerchantId] =
    useState("");

  const [
    loadingMerchants,
    setLoadingMerchants,
  ] = useState(false);

  const [
    loadingCategories,
    setLoadingCategories,
  ] = useState(true);

  /*
   * Bu yerda endi File[] emas,
   * upload bo'lgan rasmlarning URL'lari saqlanadi.
   */
  const [productImages, setProductImages] =
    useState<string[]>([]);

  const [variations, setVariations] =
    useState<CreateVariationState[]>([
      {
        id: crypto.randomUUID(),
        size: "",
        color: "",
        images: [],
      },
    ]);

  const [creating, setCreating] =
    useState(false);

  /*
   * Rasm upload bo'layotganini alohida
   * kuzatamiz.
   */
  const [
    uploadingImages,
    setUploadingImages,
  ] = useState(false);

  const [submitError, setSubmitError] =
    useState<string | null>(null);

  /* -------------------------------------------------------
     LOAD MERCHANTS
  ------------------------------------------------------- */

  useEffect(() => {
    /*
     * Agar merchantId yuqoridan berilgan bo'lsa,
     * demak Admin aniq merchant tanlagan yoki
     * oddiy user o'z merchantiga tegishli.
     *
     * Bu holatda merchant selector kerak emas.
     */
    if (merchantId) {
      setSelectedMerchantId(merchantId);
      return;
    }

    /*
     * Admin "All merchants" holatida.
     *
     * Product yaratish uchun qaysi merchantga
     * tegishli ekanini shu modalda tanlash kerak.
     */
    async function loadMerchants() {
      try {
        setLoadingMerchants(true);
        setSubmitError(null);

        const response =
          await getMerchants();

        setMerchants(
          response.data.data.merchants ?? []
        );
      } catch (error) {
        console.error(
          "Failed to load merchants:",
          error
        );

        setSubmitError(
          error instanceof Error
            ? error.message
            : "Failed to load merchants"
        );
      } finally {
        setLoadingMerchants(false);
      }
    }

    loadMerchants();
  }, [merchantId]);

  /* -------------------------------------------------------
     LOAD CATEGORIES
  ------------------------------------------------------- */

  useEffect(() => {
    const finalMerchantId =
      merchantId || selectedMerchantId;

    /*
     * Admin hali merchant tanlamagan.
     *
     * Shuning uchun category yuklamaymiz.
     */
    if (!finalMerchantId) {
      setCategories([]);
      setCategoryId("");
      setLoadingCategories(false);
      return;
    }

    async function loadCategories() {
      try {
        setLoadingCategories(true);
        setSubmitError(null);

        const response =
          await getCategories(
            finalMerchantId
          );

        setCategories(
          response.data.data.categories ?? []
        );

        /*
         * Merchant o'zgarganda eski category
         * tanlovini tozalaymiz.
         */
        setCategoryId("");
      } catch (error) {
        console.error(
          "Failed to load categories:",
          error
        );

        setSubmitError(
          error instanceof Error
            ? error.message
            : "Failed to load categories"
        );
      } finally {
        setLoadingCategories(false);
      }
    }

    loadCategories();
  }, [
    merchantId,
    selectedMerchantId,
  ]);

  /* -------------------------------------------------------
     VARIATION HELPERS
  ------------------------------------------------------- */

  const addVariation = () => {
    setVariations((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        size: "",
        color: "",
        images: [],
      },
    ]);
  };

  const removeVariation = (
    id: string
  ) => {
    setVariations((prev) =>
      prev.filter(
        (variation) =>
          variation.id !== id
      )
    );
  };

  const updateVariation = (
    id: string,
    field:
      | "size"
      | "color",
    value: string
  ) => {
    setVariations((prev) =>
      prev.map((variation) =>
        variation.id === id
          ? {
              ...variation,
              [field]: value,
            }
          : variation
      )
    );
  };

  /* -------------------------------------------------------
     PRODUCT IMAGE UPLOAD
  ------------------------------------------------------- */

  const handleProductImages = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(
      e.target.files ?? []
    );

    if (files.length === 0) {
      return;
    }

    try {
      setSubmitError(null);
      setUploadingImages(true);

      /*
       * Rasm shu zahoti serverga yuklanadi.
       *
       * uploadImages:
       * File[] -> string[]
       */
      const urls =
        await uploadImages(files);

      /*
       * Oldingi rasmlarni o'chirmaymiz.
       * Yangi URL'larni oxiriga qo'shamiz.
       */
      setProductImages((prev) => [
        ...prev,
        ...urls,
      ]);
    } catch (error) {
      console.error(
        "Failed to upload product images:",
        error
      );

      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to upload product images"
      );
    } finally {
      setUploadingImages(false);

      /*
       * Bir xil faylni qayta tanlashga
       * imkon beradi.
       */
      e.target.value = "";
    }
  };

  /* -------------------------------------------------------
     REMOVE PRODUCT IMAGE
  ------------------------------------------------------- */

  const removeProductImage = (
    index: number
  ) => {
    setProductImages((prev) =>
      prev.filter(
        (_, imageIndex) =>
          imageIndex !== index
      )
    );
  };

  /* -------------------------------------------------------
     VARIATION IMAGE UPLOAD
  ------------------------------------------------------- */

  const handleVariationImages = async (
    variationId: string,
    files: File[]
  ) => {
    if (files.length === 0) {
      return;
    }

    try {
      setSubmitError(null);
      setUploadingImages(true);

      /*
       * Variation rasmlarini ham
       * darhol serverga yuklaymiz.
       */
      const urls =
        await uploadImages(files);

      setVariations((prev) =>
        prev.map((variation) =>
          variation.id === variationId
            ? {
                ...variation,
                images: [
                  ...variation.images,
                  ...urls,
                ],
              }
            : variation
        )
      );
    } catch (error) {
      console.error(
        "Failed to upload variation images:",
        error
      );

      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to upload variation images"
      );
    } finally {
      setUploadingImages(false);
    }
  };

  /* -------------------------------------------------------
     REMOVE VARIATION IMAGE
  ------------------------------------------------------- */

  const removeVariationImage = (
    variationId: string,
    imageIndex: number
  ) => {
    setVariations((prev) =>
      prev.map((variation) =>
        variation.id === variationId
          ? {
              ...variation,
              images:
                variation.images.filter(
                  (_, index) =>
                    index !== imageIndex
                ),
            }
          : variation
      )
    );
  };

  /* -------------------------------------------------------
     CREATE PRODUCT
  ------------------------------------------------------- */

  const handleCreateProduct =
    async () => {
      try {
        setSubmitError(null);

        if (!productName.trim()) {
          setSubmitError(
            "Product name is required"
          );
          return;
        }

        /*
         * Agar global merchantId yo'q bo'lsa,
         * Admin modal ichidan merchant tanlashi kerak.
         */
        const finalMerchantId =
          merchantId || selectedMerchantId;

        if (!finalMerchantId) {
          setSubmitError(
            "Please select a merchant"
          );
          return;
        }

        if (!categoryId) {
          setSubmitError(
            "Category is required"
          );
          return;
        }

        setCreating(true);

        /*
         * Product images allaqachon upload
         * bo'lgan.
         *
         * Bu yerda qayta upload qilmaymiz.
         */

        /*
         * Variation ma'lumotlarini
         * request formatiga o'tkazamiz.
         */
        const uploadedVariations:
          CreateProductVariation[] = [];

        for (const variation of variations) {
          const variationData:
            CreateProductVariation = {
            ...(variation.size.trim()
              ? {
                  size:
                    variation.size.trim(),
                }
              : {}),

            ...(variation.color.trim()
              ? {
                  color:
                    variation.color.trim(),
                }
              : {}),

            ...(variation.images.length > 0
              ? {
                  images:
                    variation.images,
                }
              : {}),
          };

          uploadedVariations.push(
            variationData
          );
        }

        /* -------------------------------------------------
           BUILD REQUEST
        ------------------------------------------------- */

        const request:
          CreateProductRequest = {
          name: productName.trim(),

          merchants_id:
            finalMerchantId,

          category_id: categoryId,

          /*
           * Bu yerda productImages allaqachon
           * URL[].
           */
          ...(productImages.length > 0
            ? {
                images:
                  productImages,
              }
            : {}),

          ...(uploadedVariations.length > 0
            ? {
                product_variations:
                  uploadedVariations,
              }
            : {}),
        };

        /* -------------------------------------------------
           SEND REQUEST
        ------------------------------------------------- */

        const response =
          await createProduct(request);

        /* -------------------------------------------------
           CHECK RESPONSE
        ------------------------------------------------- */

        if (
          response.status !== "success" &&
          response.data?.status !==
            "success"
        ) {
          throw new Error(
            response.custom_message ||
              response.description ||
              "Failed to create product"
          );
        }

        /* -------------------------------------------------
           REFRESH PRODUCTS
        ------------------------------------------------- */

        await onCreated();

        /* -------------------------------------------------
           CLOSE MODAL
        ------------------------------------------------- */

        onClose();
      } catch (error) {
        console.error(
          "Failed to create product:",
          error
        );

        setSubmitError(
          error instanceof Error
            ? error.message
            : "Failed to create product"
        );
      } finally {
        setCreating(false);
      }
    };

  return (
    <>
      {/* -------------------------------------------------
          OVERLAY
      ------------------------------------------------- */}

      <div
        onClick={
          creating
            ? undefined
            : onClose
        }
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
      />

      {/* -------------------------------------------------
          MODAL
      ------------------------------------------------- */}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          onClick={(e) =>
            e.stopPropagation()
          }
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        >
          {/* -------------------------------------------------
              HEADER
          ------------------------------------------------- */}

          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-5">
            <div>
              <p className="text-xs font-medium text-zinc-400">
                Products
              </p>

              <h2 className="mt-1 text-xl font-semibold text-zinc-900">
                Create Product
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Add a new product to your inventory
              </p>
            </div>

            <button
              onClick={onClose}
              disabled={
                creating ||
                uploadingImages
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={19} />
            </button>
          </div>

          {/* -------------------------------------------------
              BODY
          ------------------------------------------------- */}

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {/* ERROR */}

            {submitError && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">
                  {submitError}
                </p>
              </div>
            )}

            {/* -------------------------------------------------
                PRODUCT INFORMATION
            ------------------------------------------------- */}

            <section>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Product information
                </h3>

                <p className="mt-1 text-xs text-zinc-400">
                  Basic information about your product
                </p>
              </div>

              <div className="space-y-4">

                {/* MERCHANT */}

                {!merchantId && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                      Merchant

                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <select
                      value={
                        selectedMerchantId
                      }
                      onChange={(e) =>
                        setSelectedMerchantId(
                          e.target.value
                        )
                      }
                      disabled={
                        loadingMerchants ||
                        creating ||
                        uploadingImages
                      }
                      className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-400"
                    >
                      <option value="">
                        {loadingMerchants
                          ? "Loading merchants..."
                          : "Select merchant"}
                      </option>

                      {!loadingMerchants &&
                        merchants.map(
                          (merchant) => (
                            <option
                              key={
                                merchant.guid
                              }
                              value={
                                merchant.guid
                              }
                            >
                              {
                                merchant.name
                              }
                            </option>
                          )
                        )}
                    </select>
                  </div>
                )}

                {/* PRODUCT NAME */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                    Product name

                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    type="text"
                    value={productName}
                    onChange={(e) =>
                      setProductName(
                        e.target.value
                      )
                    }
                    placeholder="e.g. Nike Air Max"
                    disabled={
                      creating ||
                      uploadingImages
                    }
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
                  />
                </div>

                {/* CATEGORY */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                    Category

                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    value={categoryId}
                    onChange={(e) =>
                      setCategoryId(
                        e.target.value
                      )
                    }
                    disabled={
                      loadingCategories ||
                      !(
                        merchantId ||
                        selectedMerchantId
                      ) ||
                      creating ||
                      uploadingImages
                    }
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-400"
                  >
                    <option value="">
                      {loadingCategories
                        ? "Loading categories..."
                        : !(
                            merchantId ||
                            selectedMerchantId
                          )
                        ? "Select merchant first"
                        : "Select category"}
                    </option>

                    {!loadingCategories &&
                      categories.map(
                        (category) => (
                          <option
                            key={
                              category.guid
                            }
                            value={
                              category.guid
                            }
                          >
                            {category.name}
                          </option>
                        )
                      )}
                  </select>
                </div>

                {/* -------------------------------------------------
                    PRODUCT IMAGES
                ------------------------------------------------- */}

                <div>
                  <div className="mb-2">
                    <label className="text-sm font-medium text-zinc-700">
                      Product images
                    </label>

                    <p className="mt-0.5 text-xs text-zinc-400">
                      Optional · You can upload multiple images
                    </p>
                  </div>

                  <input
                    id="product-images"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={
                      handleProductImages
                    }
                    disabled={
                      creating ||
                      uploadingImages
                    }
                  />

                  <div className="flex flex-wrap gap-3">
                    {/* UPLOADED IMAGES */}

                    {productImages.map(
                      (url, index) => (
                        <div
                          key={`${url}-${index}`}
                          className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                        >
                          <img
                            src={url}
                            alt={`Product image ${
                              index + 1
                            }`}
                            className="h-full w-full object-cover"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              removeProductImage(
                                index
                              )
                            }
                            disabled={
                              creating ||
                              uploadingImages
                            }
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-50"
                          >
                            <X
                              size={14}
                            />
                          </button>
                        </div>
                      )
                    )}

                    {/* ADD IMAGE */}

                    <label
                      htmlFor="product-images"
                      className={`flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition ${
                        creating ||
                        uploadingImages
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                      }`}
                    >
                      {uploadingImages ? (
                        <>
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />

                          <span className="mt-1 text-[10px] font-medium">
                            Uploading...
                          </span>
                        </>
                      ) : (
                        <>
                          <Plus size={20} />

                          <span className="mt-1 text-[11px] font-medium">
                            Add image
                          </span>
                        </>
                      )}
                    </label>
                  </div>

                  {productImages.length >
                    0 && (
                    <p className="mt-2 text-xs text-zinc-500">
                      {productImages.length}{" "}
                      image
                      {productImages.length >
                      1
                        ? "s"
                        : ""}{" "}
                      uploaded
                    </p>
                  )}
                </div>
              </div>
            </section>

            <div className="my-7 border-t border-zinc-100" />

            {/* -------------------------------------------------
                VARIATIONS
            ------------------------------------------------- */}

            <section>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Variations
                  </h3>

                  <p className="mt-1 text-xs text-zinc-400">
                    Add sizes, colors or other product variations
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    addVariation
                  }
                  disabled={
                    creating ||
                    uploadingImages
                  }
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={15} />

                  Add variation
                </button>
              </div>

              {variations.length ===
              0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-5 py-8 text-center">
                  <Package
                    size={30}
                    strokeWidth={1.3}
                    className="mx-auto text-zinc-300"
                  />

                  <p className="mt-2 text-sm font-medium text-zinc-700">
                    No variations
                  </p>

                  <p className="mt-1 text-xs text-zinc-400">
                    You can create the product without variations.
                  </p>

                  <button
                    type="button"
                    onClick={
                      addVariation
                    }
                    disabled={
                      creating ||
                      uploadingImages
                    }
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <Plus size={14} />

                    Add variation
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {variations.map(
                    (
                      variation,
                      index
                    ) => (
                      <div
                        key={
                          variation.id
                        }
                        className="rounded-xl border border-zinc-200 bg-white p-4"
                      >
                        {/* VARIATION HEADER */}

                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-600">
                              {index + 1}
                            </div>

                            <span className="text-sm font-semibold text-zinc-800">
                              Variation{" "}
                              {index + 1}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeVariation(
                                variation.id
                              )
                            }
                            disabled={
                              creating ||
                              uploadingImages
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                          >
                            <X
                              size={
                                17
                              }
                            />
                          </button>
                        </div>

                        {/* SIZE + COLOR */}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {/* SIZE */}

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                              Size
                            </label>

                            <input
                              type="text"
                              value={
                                variation.size
                              }
                              onChange={(
                                e
                              ) =>
                                updateVariation(
                                  variation.id,
                                  "size",
                                  e.target.value
                                )
                              }
                              placeholder="e.g. M"
                              disabled={
                                creating ||
                                uploadingImages
                              }
                              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
                            />
                          </div>

                          {/* COLOR */}

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                              Color
                            </label>

                            <input
                              type="text"
                              value={
                                variation.color
                              }
                              onChange={(
                                e
                              ) =>
                                updateVariation(
                                  variation.id,
                                  "color",
                                  e.target.value
                                )
                              }
                              placeholder="e.g. Black"
                              disabled={
                                creating ||
                                uploadingImages
                              }
                              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
                            />
                          </div>
                        </div>

                        {/* -------------------------------------------------
                            VARIATION IMAGES
                        ------------------------------------------------- */}

                        <div className="mt-4">
                          <label className="text-xs font-medium text-zinc-700">
                            Images
                          </label>

                          <input
                            id={`variation-images-${variation.id}`}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={
                              creating ||
                              uploadingImages
                            }
                            onChange={(
                              e
                            ) => {
                              const files =
                                Array.from(
                                  e.target
                                    .files ??
                                    []
                                );

                              handleVariationImages(
                                variation.id,
                                files
                              );

                              e.target.value =
                                "";
                            }}
                          />

                          <div className="mt-2 flex flex-wrap gap-3">
                            {/* VARIATION IMAGES */}

                            {variation.images.map(
                              (
                                url,
                                imageIndex
                              ) => (
                                <div
                                  key={`${url}-${imageIndex}`}
                                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
                                >
                                  <img
                                    src={url}
                                    alt={`Variation ${
                                      index +
                                      1
                                    } image ${
                                      imageIndex +
                                      1
                                    }`}
                                    className="h-full w-full object-cover"
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeVariationImage(
                                        variation.id,
                                        imageIndex
                                      )
                                    }
                                    disabled={
                                      creating ||
                                      uploadingImages
                                    }
                                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-50"
                                  >
                                    <X
                                      size={
                                        12
                                      }
                                    />
                                  </button>
                                </div>
                              )
                            )}

                            {/* ADD IMAGE */}

                            <label
                              htmlFor={`variation-images-${variation.id}`}
                              className={`flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition ${
                                creating ||
                                uploadingImages
                                  ? "cursor-not-allowed opacity-50"
                                  : "cursor-pointer hover:border-zinc-400 hover:bg-zinc-100"
                              }`}
                            >
                              {uploadingImages ? (
                                <>
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />

                                  <span className="mt-1 text-[10px]">
                                    Uploading...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Plus
                                    size={
                                      18
                                    }
                                  />

                                  <span className="mt-1 text-[10px]">
                                    Add image
                                  </span>
                                </>
                              )}
                            </label>
                          </div>

                          {variation.images
                            .length >
                            0 && (
                            <p className="mt-2 text-xs text-zinc-500">
                              {
                                variation
                                  .images
                                  .length
                              }{" "}
                              image
                              {variation
                                .images
                                .length >
                              1
                                ? "s"
                                : ""}{" "}
                              uploaded
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  )}

                  {/* ADD ANOTHER VARIATION */}

                  <button
                    type="button"
                    onClick={
                      addVariation
                    }
                    disabled={
                      creating ||
                      uploadingImages
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-3 text-xs font-medium text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50"
                  >
                    <Plus size={15} />

                    Add another variation
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* -------------------------------------------------
              FOOTER
          ------------------------------------------------- */}

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={
                creating ||
                uploadingImages
              }
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                handleCreateProduct
              }
              disabled={
                creating ||
                uploadingImages
              }
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />

                  Creating...
                </>
              ) : uploadingImages ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />

                  Uploading...
                </>
              ) : (
                <>
                  <Plus size={16} />

                  Create Product
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}