import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Magasin1Component } from './magasin1.component';

describe('Magasin1Component', () => {
  let component: Magasin1Component;
  let fixture: ComponentFixture<Magasin1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Magasin1Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Magasin1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
