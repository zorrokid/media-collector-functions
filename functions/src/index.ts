import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions/v2";

import {onObjectFinalized} from "firebase-functions/v2/storage";
import {getFirestore} from "firebase-admin/firestore";

import * as logger from "firebase-functions/logger";
import {createCollectionItemRepository}
  from "./repository/collectionItemRepository";
import {createImportHistoryRepository}
  from "./repository/importHistoryRepository";
import {createImportService} from "./service/importService";

setGlobalOptions({region: "europe-central2"});
initializeApp();
const firestore = getFirestore();
firestore.settings({ignoreUndefinedProperties: true});

export const onFileUpload = onObjectFinalized({
  timeoutSeconds: 300,
}, async (event) => {
  const bucketName = event.data.bucket;
  const filePath = event.data.name;
  logger.info(`New file uploaded to ${filePath} in bucket ${bucketName}`);

  const firestore = getFirestore();
  const itemRepository = createCollectionItemRepository(firestore);
  const importHistoryRepository = createImportHistoryRepository(firestore);
  const importService = createImportService(
    firestore, itemRepository, importHistoryRepository);
  return await importService.import(bucketName, filePath);
});
