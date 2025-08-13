import { icons, LucideProps } from "lucide-react";

interface IconProps extends Omit<LucideProps, "name"> {
  name: keyof typeof icons;
}

export function Icon({ name, color, size, ...props }: IconProps) {
  const LucideIcon = icons[name];

  // Invalid name
  if (!LucideIcon) {
    return null;
  }

  return <LucideIcon color={color} size={size} {...props} />;
}
