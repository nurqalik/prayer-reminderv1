import { generateReactNativeHelpers } from "@uploadthing/expo";
import type { OurFileRouter } from "../../prayer-reminder-backend/src/server/uploadthing";

/**
 * Generate typed hooks for UploadThing.
 * Note: The URL must be the full path to your UploadThing API endpoint.
 */
export const { useImageUploader, useDocumentUploader, useUploadThing, uploadFiles } = 
  generateReactNativeHelpers<OurFileRouter>({
    url: `${process.env.EXPO_PUBLIC_API_URL}/api/uploadthing`,
  });
