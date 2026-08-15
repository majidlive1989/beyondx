"use client";

import { useParams } from "next/navigation";
import { BlogPostEditor } from "@/components/blog-post-editor";

export default function EditBlogPostPage() { const params = useParams<{ id: string }>(); return <BlogPostEditor postId={decodeURIComponent(params.id)} />; }
