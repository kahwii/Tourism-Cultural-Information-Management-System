import DirectoryPage from "./DirectoryPage";

const TYPES = ["Budget", "Business", "Boutique", "Luxury", "Serviced Apartment", "Transient", "Others"];

export default function Hotels() {
  return (
    <DirectoryPage
      title="Hotels"
      subtitle="Manage accommodations and lodging establishments."
      icon="bed"
      table="hotels"
      categoryColumn="type"
      categoryLabel="Type"
      categoryOptions={TYPES}
      addLabel="+ Add Hotel"
      exportName="hotels"
    />
  );
}
