import DirectoryPage from "./DirectoryPage";

const CUISINES = ["Contemporary", "Spanish", "Chinese", "Italian Contemporary", "Filipino", "Japanese", "Korean", "American", "Café", "Others"];

export default function Restaurants() {
  return (
    <DirectoryPage
      title="Restaurants"
      subtitle="Manage dining establishments and food businesses."
      icon="utensils"
      table="restaurants"
      categoryColumn="cuisine"
      categoryLabel="Cuisine"
      categoryOptions={CUISINES}
      addLabel="+ Add Restaurant"
      exportName="restaurants"
    />
  );
}
