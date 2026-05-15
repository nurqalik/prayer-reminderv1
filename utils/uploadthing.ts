import { generateReactNativeHelpers } from "@uploadthing/expo";
import type { OurFileRouter } from "../../prayer-reminder-backend/src/server/uploadthing";

/**
 * Generate typed hooks for UploadThing.
 * Note: The URL must be the full path to your UploadThing API endpoint.
 */
export const { useImageUploader, useDocumentUploader } = 
  generateReactNativeHelpers<OurFileRouter>({
    url: "https://prayer-reminder-backend.vercel.app/api/uploadthing",
  });
