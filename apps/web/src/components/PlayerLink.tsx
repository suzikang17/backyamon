import Link from "next/link";

interface PlayerLinkProps {
  username: string;
  className?: string;
}

export function PlayerLink({ username, className }: PlayerLinkProps) {
  return (
    <Link
      href={`/player/${encodeURIComponent(username)}`}
      className={`hover:underline cursor-pointer ${className ?? "text-[#FFD700] font-heading"}`}
    >
      {username}
    </Link>
  );
}
