export interface FileObjectDto {
  id: string;
  name: string;
  description: string | null;
  contentType: string;
  sizeBytes: number;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  etag?: string;
}
