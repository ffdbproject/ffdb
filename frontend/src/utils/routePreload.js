const routeLoaders = {
  '/': () => import('../pages/HomePage'),
  '/species': () => import('../pages/SpeciesListPage'),
  '/search': () => import('../pages/SearchPage'),
  '/contribute': () => import('../pages/ContributePage'),
  '/report-problem': () => import('../pages/ReportProblemPage'),
  '/team': () => import('../pages/TeamPage'),
  '/about': () => import('../pages/AboutPage'),
  '/api-docs': () => import('../pages/ApiDocsPage'),
  '/admin': () => import('../pages/AdminPage'),
  '/admin/species/add': () => import('../pages/AddSpeciesPage'),
};

const prefetchedRoutes = new Set();

export function preloadRoute(path) {
  if (!path || prefetchedRoutes.has(path)) return;
  const loader = routeLoaders[path];
  if (!loader) return;

  prefetchedRoutes.add(path);
  loader().catch(() => {
    prefetchedRoutes.delete(path);
  });
}
