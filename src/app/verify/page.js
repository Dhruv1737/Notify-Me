import VerifyButton from "@/components/VerifyButton";

export default async function VerifyPage({ searchParams }) {
  const { token } = await searchParams;

  return (
    <main>
      <h1>Verify email</h1>
      {typeof token === "string" ? (
        <VerifyButton token={token} />
      ) : (
        <p className="error">This link is invalid or has expired.</p>
      )}
    </main>
  );
}