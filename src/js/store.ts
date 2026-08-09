
import { createStore } from 'framework7/lite';

export interface Product {
  id: string;
  title: string;
  description: string;
}

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export interface AppState {
  products: Product[];
  palettes: Palette[];
}

interface StoreCtx {
  state: AppState;
}

const store = createStore({
  state: <AppState>{
    products: [
      {
        id: '1',
        title: 'Apple iPhone 8',
        description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nisi tempora similique reiciendis, error nesciunt vero, blanditiis pariatur dolor, minima sed sapiente rerum, dolorem corrupti hic modi praesentium unde saepe perspiciatis.'
      },
      {
        id: '2',
        title: 'Apple iPhone 8 Plus',
        description: 'Velit odit autem modi saepe ratione totam minus, aperiam, labore quia provident temporibus quasi est ut aliquid blanditiis beatae suscipit odio vel! Nostrum porro sunt sint eveniet maiores, dolorem itaque!'
      },
      {
        id: '3',
        title: 'Apple iPhone X',
        description: 'Expedita sequi perferendis quod illum pariatur aliquam, alias laboriosam! Vero blanditiis placeat, mollitia necessitatibus reprehenderit. Labore dolores amet quos, accusamus earum asperiores officiis assumenda optio architecto quia neque, quae eum.'
      },
    ],
    palettes: [
      {
        id: 'p1',
        name: 'Dusk',
        colors: ['#2b2d42', '#8d99ae', '#edf2f4', '#ef233c', '#d90429'],
      },
      {
        id: 'p2',
        name: 'Citrus',
        colors: ['#fec89a', '#ffd7ba', '#fec5bb', '#f8edeb', '#d8e2dc'],
      },
      {
        id: 'p3',
        name: 'Forest',
        colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
      },
    ],
  },
  getters: {
    products({ state }: StoreCtx) {
      return state.products;
    },
    palettes({ state }: StoreCtx) {
      return state.palettes;
    },
  },
  actions: {
    addProduct({ state }: StoreCtx, product: Product) {
      state.products = [...state.products, product];
    },
    renamePalette({ state }: StoreCtx, { id, name }: { id: string; name: string }) {
      state.palettes = state.palettes.map((p) => (p.id === id ? { ...p, name } : p));
    },
    addColor({ state }: StoreCtx, { id, color }: { id: string; color: string }) {
      state.palettes = state.palettes.map((p) =>
        p.id === id ? { ...p, colors: [...p.colors, color] } : p,
      );
    },
    removeColor({ state }: StoreCtx, { id, index }: { id: string; index: number }) {
      state.palettes = state.palettes.map((p) =>
        p.id === id ? { ...p, colors: p.colors.filter((_, i) => i !== index) } : p,
      );
    },
  },
})
export default store;
