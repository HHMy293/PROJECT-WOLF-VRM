import Link from "next/link";
export default function NotFound() {
  return (
    <main style={{ padding: "15vh 24px", textAlign: "center" }}>
      <h1>Con đường này đã chìm trong sương...</h1>
      <p>Không tìm thấy trang bạn đang tìm.</p>
      <Link href="/">Trở về ngôi làng</Link>
    </main>
  );
}
