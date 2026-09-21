import { ColorSliders } from "./ColorSliders";

export const HslaSliders = (props: { value: string; onChange: (value: string) => void }) => (
  <ColorSliders {...props} model="hsl" />
);
