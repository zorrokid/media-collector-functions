import {Firestore} from "firebase-admin/firestore";
import {CollectionItemRepository}
  from "../repository/collectionItemRepository";
import {ImportHistoryRepository}
  from "../repository/importHistoryRepository";
import {parse} from "csv-parse";
import {getStorage} from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";

interface ImportService {
  import: (bucketName: string, filePath: string) => Promise<void>
}

export const createImportService = (
  firestore: Firestore,
  itemRepository: CollectionItemRepository,
  importHistoryRepository: ImportHistoryRepository,
): ImportService => {
  return {
    import: async (bucketName: string, filePath: string): Promise<void> => {
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

      const cvsParser = file.createReadStream()
        .pipe(parser);

      for await (const record of cvsParser) {
        logger.info("1. Start parsing record", record);

        if (!record["sourceId"]) {
          logger.warn("sourceId is missing, skipping item: ", record);
        }

        const releaseAreaName = record["releaseArea"];
        if (releaseAreaName && !releaseAreasMap.has(releaseAreaName)) {
          const doc = await firestore.collection("releaseAreas").add({
            name: releaseAreaName,
          });
          releaseAreasMap.set(releaseAreaName, doc.id);
        }
        const releaseAreaId = releaseAreasMap.get(releaseAreaName);
        logger.info("2. releaseAreaId", releaseAreaId);

        const conditionClassificationName = record[
          "conditionClassification"
        ];
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
        logger.info("3. conditionClassificationId",
          conditionClassificationId);

        const item = {
          barcode: record["barcode"],
          name: record["name"],
          conditionClassificationName,
          conditionClassificationId,
          releaseAreaName,
          releaseAreaId,
          userId: record["userId"],
          sourceId: record["sourceId"],
          originalName: record["originalName"],
        };

        logger.info("4. Create item", item);
        logger.info("5. Start add or update for item with sourceId");
        await itemRepository.addOrUpdate(item);
        logger.info("6. Finished add or update for item with sourceId");
      }

      logger.info("Finished parsing");
      await importHistoryRepository
        .addHistoryEntry(filePath, 0);

      logger.info("Deleting import file");
      await file.delete();
      return logger.info("Finished deleting import file");
    },
  };
};
