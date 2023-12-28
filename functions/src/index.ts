/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions/v2";

import {onObjectFinalized} from "firebase-functions/v2/storage";
import {getStorage} from "firebase-admin/storage";
import {getFirestore} from "firebase-admin/firestore";

import * as logger from "firebase-functions/logger";
import * as path from "path";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

setGlobalOptions({region: "europe-central2"});
initializeApp();

type ImportHistoryEntry = {
  time: Date;
  fileName: string;
  itemsImported: number;
}


export const onFileUpload = onObjectFinalized((event) => {
  logger.info(event);
  logger.info("Got file uploaded to bucket", event.bucket);
  logger.info("Object data is ", event.data);
  const bucketName = event.data.bucket;
  const filePath = event.data.name;
  const file = getStorage()
    .bucket(bucketName)
    .file(filePath);
  const readStream = file
    .createReadStream();

  readStream.pipe(process.stdout);

  // TODO validate and parse file content
  // TODO write data to firestore

  const document = getFirestore().collection("importHistory").doc();
  const importHistoryEntry: ImportHistoryEntry = {
    time: new Date(),
    fileName: path.basename(filePath),
    itemsImported: 0,
  };
  document.set(importHistoryEntry);
  file.delete().then(() => {
    logger.log("Upload file deleted successfully");
  }).catch((error) => {
    logger.error("Error deleting upload file", error);
  });
});

// I want to create a function which trigger on firebase storage bucket upload
// https://firebase.google.com/docs/storage/web/upload-files

