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
import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

setGlobalOptions({region: "europe-central2"});
initializeApp();


export const onFileUpload = onObjectFinalized((event) => {
  logger.info(event);
  logger.info("Got file uploaded to bucket", event.bucket);
  logger.info("Object data is ", event.data);
  const bucketName = event.data.bucket;
  const filePath = event.data.name;
  const readStream = getStorage()
    .bucket(bucketName)
    .file(filePath)
    .createReadStream();
  readStream.pipe(process.stdout);
});

// I want to create a function which trigger on firebase storage bucket upload
// https://firebase.google.com/docs/storage/web/upload-files

