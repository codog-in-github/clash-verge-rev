import { createBrowserRouter, RouteObject } from 'react-router'

import Layout from './_layout'
import { navItems } from './_navigation'
import TrayPage from './tray'

export const router = createBrowserRouter([
  { path: '/tray', Component: TrayPage },
  {
    path: '/',
    Component: Layout,
    children: navItems.map(
      (item) =>
        ({
          path: item.path,
          Component: item.Component,
        }) as RouteObject,
    ),
  },
])
