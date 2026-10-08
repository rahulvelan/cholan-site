import { Link } from 'react-router-dom';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import { blogPosts } from '../../data/blogPosts.js';

export default function Journal() {
  return (
    <section className="section section--alt">
      <div className="container">
        <div className="row wrap gap-16 section-head-row">
          <SectionHeading eyebrow="From the journal" title="Recipes, farming notes and nutrition" />
          <Link to="/blog" className="btn btn--ghost btn--sm">
            Read the blog
          </Link>
        </div>
        <div className="grid grid--3">
          {blogPosts.slice(0, 3).map((post) => (
            <Link key={post.slug} to="/blog" className="postcard">
              <div
                className={`postcard__ph${post.imageFit === 'contain' ? ' postcard__ph--contain' : ''}`}
              >
                <img src={post.image} alt="" loading="lazy" decoding="async" />
              </div>
              <div className="postcard__body">
                <span className="postcard__meta">
                  {post.category} · {post.readTime}
                </span>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
