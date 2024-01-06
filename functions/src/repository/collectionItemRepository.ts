import {Firestore} from "firebase-admin/firestore";
import {CollectionItem} from "../types";
import * as logger from "firebase-functions/logger";

export interface CollectionItemRepository {
  addOrUpdate: (collectionItems: Array<CollectionItem>) => Promise<void>
}

export const createCollectionItemRepository = (
  firestore: Firestore,
): CollectionItemRepository => {
  return {
    addOrUpdate: async (items: Array<CollectionItem>) => {
      logger.info(`Start add or update with ${items.length} items.`);
      const collectionItemsRef = firestore.collection("collectionItems");
      let addedItems = 0;
      let updatedItems = 0;
      for (const item of items) {
        logger.info(`Start add or update for item with sourceId ${
          item.sourceId}`, item);
        const existingItem = await collectionItemsRef
          .where("sourceId", "==", item.sourceId)
          .get();
        if (existingItem.empty) {
          const doc = await firestore
            .collection("collectionItems")
            .add(item);
          logger.info(`Added new item with document id ${
            doc.id} from sourceId ${item.sourceId}`);
          addedItems++;
        } else {
          if (existingItem.docs.length > 1) {
            throw new Error("More than one item with the same sourceId");
          }
          const documentId = existingItem.docs[0].id;
          logger.info(`Updating existing item with document id ${
            documentId} and sourceId ${item.sourceId}`);
          await existingItem.docs[0].ref
            .set(item, {merge: true});
          updatedItems++;
        }
      }
      logger.info(`Added ${addedItems} items`);
      logger.info(`Updated ${updatedItems} items`);
    },
  };
};
