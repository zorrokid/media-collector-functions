import {Firestore} from "firebase-admin/firestore";

export interface ImportHistoryRepository {
    addHistoryEntry: (fileName: string) => Promise<void>;
}

export const createImportHistoryRepository = (
  firestore: Firestore,
): ImportHistoryRepository => {
  return {
    addHistoryEntry: async (fileName: string) => {
      await firestore.collection("importHistory").add({
        time: new Date(),
        fileName: fileName,
      });
    },
  };
};
