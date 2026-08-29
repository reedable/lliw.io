import type { Router } from "framework7/types";

import HomePage from "./pages/HomePage";
import ColorPage from "./pages/ColorPage";
import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";

const routes: Router.RouteParameters[] = [
  {
    path: "/",
    component: HomePage,
  },
  {
    // Pushed from a colour row inside an expanded palette card. Must stay ahead of
    // the '(.*)' catch-all below, which would otherwise swallow it.
    path: "/palette/:paletteId/color/:colorId/",
    component: ColorPage,
  },
  {
    path: "/settings/",
    component: SettingsPage,
  },
  {
    path: "(.*)",
    component: NotFoundPage,
  },
];

export default routes;
