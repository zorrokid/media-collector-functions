import {Firestore} from "firebase-admin/firestore";

export interface ImportHistoryRepository {
    addHistoryEntry: (
      fileName: string,
      importedItemsCount: number
    ) => Promise<void>;
}

export const createImportHistoryRepository = (
  firestore: Firestore,
): ImportHistoryRepository => {
  return {
    addHistoryEntry: async (fileName: string, importedItemsCount: number) => {
      await firestore.collection("importHistory").add({
        time: new Date(),
        fileName,
        importedItemsCount,
      });
    },
  };
};
