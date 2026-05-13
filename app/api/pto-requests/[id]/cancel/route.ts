import { DELETE } from "../route";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return DELETE(request, context);
}
