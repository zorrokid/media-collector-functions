import {Firestore} from "firebase-admin/firestore";
import {CollectionItemRepository}
  from "../repository/collectionItemRepository";
import {ImportHistoryRepository}
  from "../repository/importHistoryRepository";
import {parse} from "csv-parse";
import {getStorage} from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import {CollectionItem} from "../types";
import {finished} from "stream/promises";

interface ImportService {
  import: (bucketName: string, filePath: string) => Promise<void>
}

export const createImportService = (
  firestore: Firestore,
  itemRepository: CollectionItemRepository,
  importHistoryRepository: ImportHistoryRepository,
): ImportService => {
  return {
    import: async (bucketName: string, filePath: string) => {
      const file = getStorage()
        .bucket(bucketName)
        .file(filePath);

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
          const valueTrimmed = value.trim();
          if (valueTrimmed === "") {
            return undefined;
          }
          return valueTrimmed;
        },
      });

      const importItems: CollectionItem[] = [];
      const cvsParser = file.createReadStream()
        .pipe(parser);
      cvsParser
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
          const releaseAreaId = releaseAreasMap.get(releaseAreaName);

          const conditionClassificationName = data["conditionClassification"];
          if (conditionClassificationName &&
            !conditionClassificationsMap.has(conditionClassificationName)) {
            const doc = await firestore
              .collection("conditionClassifications")
              .add({
                name: conditionClassificationName,
              });
            conditionClassificationsMap
              .set(conditionClassificationName, doc.id);
          }
          const conditionClassificationId = conditionClassificationsMap
            .get(conditionClassificationName);

          importItems.push({
            barcode: data["barcode"],
            name: data["name"],
            conditionClassificationName,
            conditionClassificationId,
            releaseAreaName,
            releaseAreaId,
            userId: data["userId"],
            sourceId: data["sourceId"],
            originalName: data["originalName"],
          });
        });

      await finished(cvsParser);
      await itemRepository.addOrUpdate(importItems);
      await importHistoryRepository
        .addHistoryEntry(filePath, importItems.length);

      file.delete().then(() => {
        logger.info("Upload file deleted successfully");
      }).catch((error) => {
        logger.error("Error deleting upload file", error);
      });
    },
  };
};
