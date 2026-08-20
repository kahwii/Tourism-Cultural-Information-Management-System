import DirectoryPage from "./DirectoryPage";

const TYPES = ["Shopping Mall", "Commercial Complex", "Travel Agency", "Event Venue", "Wellness/Spa", "Entertainment", "Others"];

export default function TourismBusinesses() {
  return (
    <DirectoryPage
      title="Tourism Businesses"
      subtitle="Manage registered tourism-related establishments."
      icon="store"
      table="tourism_businesses"
      categoryColumn="type"
      categoryLabel="Type"
      categoryOptions={TYPES}
      addLabel="+ Add Business"
      exportName="tourism_businesses"
    />
  );
}
