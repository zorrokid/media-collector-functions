import {Firestore} from "firebase-admin/firestore";

export interface ImportHistoryRepository {
    addHistoryEntry: (fileName: string, itemsImported: number) => Promise<void>;
}

export const createImportHistoryRepository = (
  firestore: Firestore,
): ImportHistoryRepository => {
  return {
    addHistoryEntry: async (fileName: string, itemsImported: number) => {
      await firestore.collection("importHistory").add({
        time: new Date(),
        fileName: fileName,
        itemsImported: itemsImported,
      });
    },
  };
};
