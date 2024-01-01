import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions/v2";

import {onObjectFinalized} from "firebase-functions/v2/storage";
import {getStorage} from "firebase-admin/storage";
import {getFirestore} from "firebase-admin/firestore";
import {parse} from "csv-parse";

import * as logger from "firebase-functions/logger";
import {CollectionItem} from "./types";
import {createCollectionItemRepository}
  from "./repository/collectionItemRepository";
import {createImportHistoryRepository}
  from "./repository/importHistoryRepository";

setGlobalOptions({region: "europe-central2"});
initializeApp();

export const onFileUpload = onObjectFinalized(async (event) => {
  const bucketName = event.data.bucket;
  const filePath = event.data.name;
  logger.info(`New file uploaded to ${filePath} in bucket ${bucketName}`);

  const file = getStorage()
    .bucket(bucketName)
    .file(filePath);
  const readStream = file
    .createReadStream();

  const firestore = getFirestore();
  firestore.settings({ignoreUndefinedProperties: true});
  const itemRepository = createCollectionItemRepository(firestore);
  const importHistoryRepository = createImportHistoryRepository(firestore);

  const releaseAreasMap = new Map<string, string>();
  const releaseAreasSnap = await firestore.collection("releaseAreas").get();
  for (const doc of releaseAreasSnap.docs) {
    releaseAreasMap.set(doc.data()["name"], doc.id);
  }

  const conditionClassificationsMap = new Map<string, string>();
  const conditionClassificationsSnap = await firestore
    .collection("conditionClassifications").get();
  for (const doc of conditionClassificationsSnap.docs) {
    conditionClassificationsMap.set(doc.data()["name"], doc.id);
  }

  const parser = parse({
    delimiter: "\t",
    columns: true,
    cast: (value /* , context argument can be used to check column */) => {
      if (value.trim() === "") {
        return undefined;
      }
      return value;
    },
  });
  let itemsImported = 0;

  readStream
    .pipe(parser)
    .on("data", async (data) => {
      logger.info("Start parsing item", data);

      if (!data["sourceId"]) {
        logger.warn("sourceId is missing, skipping item: ", data);
      }

      const releaseAreaName = data["releaseArea"];
      if (releaseAreaName && !releaseAreasMap.has(releaseAreaName)) {
        const doc = await firestore.collection("releaseAreas").add({
          name: releaseAreaName,
        });
        releaseAreasMap.set(releaseAreaName, doc.id);
      }
      const conditionClassificationName = data["conditionClassification"];
      if (conditionClassificationName &&
        !conditionClassificationsMap.has(conditionClassificationName)) {
        const doc = await firestore.collection("conditionClassifications").add({
          name: conditionClassificationName,
        });
        conditionClassificationsMap.set(conditionClassificationName, doc.id);
      }
      const releaseAreaId = releaseAreasMap.get(releaseAreaName);
      const conditionClassificationId = conditionClassificationsMap
        .get(conditionClassificationName);

      const item: CollectionItem = {
        barcode: data["barcode"],
        name: data["name"],
        conditionClassificationName,
        conditionClassificationId,
        releaseAreaName,
        releaseAreaId,
        userId: data["userId"],
        sourceId: data["sourceId"],
        originalName: data["originalName"],
      };
      itemRepository.addOrUpdate(item);
      itemsImported++;
    })
    .on("end", () => {
      logger.info(`Finished parsing file ${filePath}`);
      importHistoryRepository.addHistoryEntry(filePath, itemsImported);
      file.delete().then(() => {
        logger.log("Upload file deleted successfully");
      }).catch((error) => {
        logger.error("Error deleting upload file", error);
      });
    })
    .on("error", (error) => {
      logger.error("Error parsing file", error);
    });
});
