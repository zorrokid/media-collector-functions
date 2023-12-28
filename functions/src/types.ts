export type ImportHistoryEntry = {
  time: Date;
  fileName: string;
  itemsImported: number;
}

export type CollectionItem = {
  barcode: string;
  conditionClassificationId: string;
  conditionClassificationName: string;
  name: string;
  releaseAreaId: string;
  releaseAreaName: string;
  userId: string;
}
