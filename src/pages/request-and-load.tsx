import { Page, Navbar, Block, List, ListItem } from 'framework7-react';

interface UserLink {
  title: string;
  url: string;
}

interface User {
  firstName: string;
  lastName: string;
  about: string;
  links: UserLink[];
}

const RequestAndLoad = ({ user }: { user: User }) => {
  return (
    <Page>
      <Navbar title={`${user.firstName} ${user.lastName}`} backLink />
      <Block strong inset>
        {user.about}
      </Block>
      <List strong inset dividersIos>
        {user.links.map((link, index) => (
          <ListItem
            key={index}
            link={link.url}
            title={link.title}
            external
            target="_blank"
          ></ListItem>
        ))}
      </List>
    </Page>
  );
};

export default RequestAndLoad;
