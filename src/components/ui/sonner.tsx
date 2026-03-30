import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

const Toaster = ({ ...props }: ToasterProps) => (
  <SonnerToaster className="toaster group" {...props} />
);

export { Toaster };
