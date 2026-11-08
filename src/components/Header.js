import UserMenu from "./UserMenu";

export default function Header({ email }) {
  return (
    <header className="header">
      <span className="brand">Change Detector</span>
      <UserMenu email={email} />
    </header>
  );
}