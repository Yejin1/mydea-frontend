export type WorkItem = {
  id: number;
  name: string;
  workType: "ring" | "bracelet" | "necklace";
  designType: "basic" | "flower";
  previewUrl: string | null;
  signedPreviewUrl?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedResponse = {
  content: WorkItem[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
};

export interface WorksResult {
  items: WorkItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
