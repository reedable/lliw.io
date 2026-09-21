import { ColorSliders } from "./ColorSliders";

export const OklchSliders = (props: { value: string; onChange: (value: string) => void }) => (
  <ColorSliders {...props} model="oklch" />
);
