import BulkAction from "@/components/admin-v2/BulkAction"
export default function DeleteRejectedButton({ count }: { count: number }) {
  return <BulkAction operation="delete" loadedCount={count} />
}
