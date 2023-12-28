import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions/v2";

import {onObjectFinalized} from "firebase-functions/v2/storage";
import {getStorage} from "firebase-admin/storage";
import {getFirestore} from "firebase-admin/firestore";
import {parse} from "csv-parse";

import * as logger from "firebase-functions/logger";
import * as path from "path";
import {CollectionItem, ImportHistoryEntry} from "./types";

setGlobalOptions({region: "europe-central2"});
initializeApp();


export const onFileUpload = onObjectFinalized(async (event) => {
  const bucketName = event.data.bucket;
  const filePath = event.data.name;
  const file = getStorage()
    .bucket(bucketName)
    .file(filePath);
  const readStream = file
    .createReadStream();

  const firestore = getFirestore();

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
    delimiter: ";",
    columns: true,
  });
  let itemsImported = 0;

  readStream
    .pipe(parser)
    .on("data", async (data) => {
      logger.info("Got data", data);
      const releaseAreaName = data["releaseArea"];
      if (!releaseAreasMap.has(releaseAreaName)) {
        const doc = await firestore.collection("releaseAreas").add({
          name: releaseAreaName,
        });
        releaseAreasMap.set(releaseAreaName, doc.id);
      }
      const conditionClassificationName = data["conditionClassification"];
      if (!conditionClassificationsMap.has(conditionClassificationName)) {
        const doc = await firestore.collection("conditionClassifications").add({
          name: conditionClassificationName,
        });
        conditionClassificationsMap.set(conditionClassificationName, doc.id);
      }
      const releaseAreaId = releaseAreasMap.get(releaseAreaName);
      if (releaseAreaId === undefined) {
        throw new Error("releaseAreaId is undefined");
      }
      const conditionClassificationId = conditionClassificationsMap
        .get(conditionClassificationName);
      if (conditionClassificationId === undefined) {
        throw new Error("conditionClassificationId is undefined");
      }

      const item: CollectionItem = {
        barcode: data["barcode"],
        name: data["name"],
        conditionClassificationName,
        conditionClassificationId,
        releaseAreaName,
        releaseAreaId,
        userId: data["userId"],
      };
      firestore.collection("collectionItems").add(item);
      itemsImported++;
    })
    .on("end", () => {
      const document = firestore.collection("importHistory").doc();
      const importHistoryEntry: ImportHistoryEntry = {
        time: new Date(),
        fileName: path.basename(filePath),
        itemsImported: itemsImported,
      };
      document.set(importHistoryEntry);
      file.delete().then(() => {
        logger.log("Upload file deleted successfully");
      }).catch((error) => {
        logger.error("Error deleting upload file", error);
      });
    });
});
