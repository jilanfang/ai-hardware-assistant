type UploadCandidate = {
  name: string;
  size: number;
  type: string;
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateUploadedFile(file: UploadCandidate | null | undefined) {
  if (!file) {
    return "请先选择一份数据手册 PDF。";
  }

  const hasPdfMime = file.type === "application/pdf";
  const hasPdfName = /\.pdf$/i.test(file.name);

  if (!hasPdfMime && !hasPdfName) {
    return "请上传 PDF 格式的数据手册。";
  }

  if (file.size <= 0) {
    return "上传的 PDF 为空，请重新选择文件。";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "PDF 不能超过 10 MB，请压缩后再试。";
  }

  return null;
}
