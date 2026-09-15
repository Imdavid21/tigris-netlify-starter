import { redirect } from "next/navigation";

type Props = { params: Promise<{ address: string }> };

export default async function ScannerPage({ params }: Props) {
  const { address } = await params;
  redirect("/token/" + address);
}
