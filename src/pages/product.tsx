import { Page, Navbar, BlockTitle, Block, useStore } from 'framework7-react';
import type { Router } from 'framework7/types';
import type { Product } from '../js/store';

interface ProductPageProps {
  f7route: Router.Route;
}

const ProductPage = ({ f7route }: ProductPageProps) => {
  const productId = f7route.params.id;
  const products = useStore('products') as Product[];

  const currentProduct = products.find((product) => product.id === productId);

  if (!currentProduct) {
    return (
      <Page name="product">
        <Navbar title="Not found" backLink />
        <Block>No product matches id {productId}.</Block>
      </Page>
    );
  }

  return (
    <Page name="product">
      <Navbar title={currentProduct.title} backLink />
      <BlockTitle>About {currentProduct.title}</BlockTitle>
      <Block>{currentProduct.description}</Block>
    </Page>
  );
};

export default ProductPage;
