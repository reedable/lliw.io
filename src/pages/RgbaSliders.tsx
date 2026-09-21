import { ColorSliders } from "./ColorSliders";

export const RgbaSliders = (props: { value: string; onChange: (value: string) => void }) => (
  <ColorSliders {...props} model="rgb" />
);
