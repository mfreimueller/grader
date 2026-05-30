import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/courses',
  },
  {
    path: '/students',
    name: 'Students',
    component: () => import('./views/StudentsView.vue'),
  },
  {
    path: '/classes',
    name: 'Classes',
    component: () => import('./views/ClassesView.vue'),
  },
  {
    path: '/courses',
    name: 'Courses',
    component: () => import('./views/CoursesView.vue'),
  },
  {
    path: '/courses/:courseId',
    name: 'CourseWorkspace',
    component: () => import('./views/CourseWorkspaceView.vue'),
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('./views/ReportsView.vue'),
  },
  {
    path: '/bin',
    name: 'Bin',
    component: () => import('./views/BinView.vue'),
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
