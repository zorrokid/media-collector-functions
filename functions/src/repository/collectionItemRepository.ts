import {Firestore} from "firebase-admin/firestore";
import {CollectionItem} from "../types";
import * as logger from "firebase-functions/logger";

export interface CollectionItemRepository {
    addOrUpdate: (collectionItem: CollectionItem) => Promise<CollectionItem>
}

export const createCollectionItemRepository = (
  firestore: Firestore,
): CollectionItemRepository => {
  return {
    addOrUpdate: async (item: CollectionItem) => {
      const collectionItemsRef = firestore.collection("collectionItems");
      const existingItem = await collectionItemsRef
        .where("sourceId", "==", item.sourceId)
        .get();
      if (existingItem.empty) {
        const doc = await firestore.collection("collectionItems").add(item);
        logger.info(`Added new item with document id ${
          doc.id} from sourceId ${item.sourceId}`);
      } else {
        if (existingItem.docs.length > 1) {
          throw new Error("More than one item with the same sourceId");
        }
        const documentId = existingItem.docs[0].id;
        logger.info(`Updating existing item with document id ${
          documentId} and sourceId ${item.sourceId}`);
        await firestore.collection("collectionItems").doc(documentId).set(item);
      }

      return item;
    },
  };
};

