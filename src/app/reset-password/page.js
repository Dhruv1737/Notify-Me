import ResetForm from "@/components/ResetForm";

export default async function ResetPasswordPage({ searchParams }) {
  const { token } = await searchParams;

  return (
    <main>
      <h1>Choose a new password</h1>
      {typeof token === "string" ? (
        <ResetForm token={token} />
      ) : (
        <p className="error">This link is invalid or has expired.</p>
      )}
    </main>
  );
}