import LogoutButton from "./LogoutButton";

export default function Header({ email }) {
  return (
    <header className="header">
      <span className="brand">Change Detector</span>
      <div className="right">
        <span>{email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}