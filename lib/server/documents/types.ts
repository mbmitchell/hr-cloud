export type DocumentUploaderSummary = {
  id: string;
  firstName: string;
  lastName: string;
};

export type EmployeeDocumentMetadata = {
  id: string;
  employeeId: string;
  category: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  description: string | null;
  status: string;
  uploadedAt: Date;
  uploader: DocumentUploaderSummary;
};
