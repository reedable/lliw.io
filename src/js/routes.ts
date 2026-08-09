
import type { Router } from 'framework7/types';

import HomePage from '../pages/home';
import ColorPage from '../pages/color';
import SettingsPage from '../pages/settings';
import NotFoundPage from '../pages/404';

const routes: Router.RouteParameters[] = [
  {
    path: '/',
    component: HomePage,
  },
  {
    // Pushed from a colour row inside an expanded palette card. Must stay ahead of
    // the '(.*)' catch-all below, which would otherwise swallow it.
    path: '/palette/:paletteId/color/:colorIndex/',
    component: ColorPage,
  },
  {
    path: '/settings/',
    component: SettingsPage,
  },
  {
    path: '(.*)',
    component: NotFoundPage,
  },
];

export default routes;
