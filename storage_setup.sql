-- 1. Create the 'avatars' bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- 2. Allow PUBLIC access to view images (Read Policy)
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 3. Allow AUTHENTICATED users to upload their own images (Insert Policy)
create policy "Allow Individual Uploads"
on storage.objects for insert
with check (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 4. Allow AUTHENTICATED users to update their own images (Update Policy)
create policy "Allow Individual Updates"
on storage.objects for update
using (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 5. Allow AUTHENTICATED users to delete their own images (Delete Policy)
create policy "Allow Individual Deletions"
on storage.objects for delete
using (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);
