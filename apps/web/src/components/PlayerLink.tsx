import Link from "next/link";

interface PlayerLinkProps {
  username: string;
  className?: string;
}

export function PlayerLink({ username, className }: PlayerLinkProps) {
  return (
    <Link
      href={`/player/${encodeURIComponent(username)}`}
      className={`hover:underline cursor-pointer ${className ?? "text-gold font-heading"}`}
    >
      {username}
    </Link>
  );
}
