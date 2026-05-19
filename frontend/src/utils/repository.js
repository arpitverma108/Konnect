export const resolveRepositoryUrl=(repo={})=>
  repo?.svn_url
  ||
  repo?.repo_url
  ||
  repo?.clone_url
  ||
  repo?.url
  ||
  ''
